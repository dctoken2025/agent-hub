#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { getScheduler, Notifier } from '@agent-hub/core';
import { EmailAgent } from '@agent-hub/email-agent';
const program = new Command();
program
    .name('agent-hub')
    .description('CLI para gerenciar agentes autônomos')
    .version('1.0.0');
// Comando: listar agentes
program
    .command('list')
    .description('Lista todos os agentes registrados')
    .action(() => {
    const scheduler = getScheduler();
    const agents = scheduler.getAgents();
    if (agents.length === 0) {
        console.log(chalk.yellow('Nenhum agente registrado'));
        return;
    }
    console.log(chalk.bold('\n📋 Agentes Registrados:\n'));
    agents.forEach(agent => {
        const statusEmoji = agent.status === 'running' ? '🟢' :
            agent.status === 'paused' ? '🟡' :
                agent.status === 'error' ? '🔴' : '⚪';
        console.log(`${statusEmoji} ${chalk.bold(agent.config.name)} (${agent.config.id})`);
        console.log(`   ${chalk.gray(agent.config.description)}`);
        console.log(`   Status: ${agent.status} | Execuções: ${agent.runCount}`);
        if (agent.lastRun) {
            console.log(`   Última execução: ${agent.lastRun.toLocaleString('pt-BR')}`);
        }
        console.log();
    });
});
// Comando: executar email agent
program
    .command('email')
    .description('Gerencia o agente de emails')
    .option('-r, --run', 'Executa uma vez')
    .option('-s, --start', 'Inicia o agente em modo contínuo')
    .option('--auth', 'Inicia processo de autenticação')
    .action(async (options) => {
    const spinner = ora();
    // Verifica configuração
    if (!process.env.ANTHROPIC_API_KEY) {
        console.log(chalk.red('❌ ANTHROPIC_API_KEY não configurada'));
        console.log(chalk.gray('   Configure no arquivo .env'));
        return;
    }
    const emailConfig = {
        userEmail: process.env.USER_EMAIL || '',
        vipSenders: (process.env.VIP_SENDERS || '').split(',').filter(Boolean),
        ignoreSenders: (process.env.IGNORE_SENDERS || '').split(',').filter(Boolean),
        labelsToProcess: ['INBOX'],
        maxEmailsPerRun: 50,
        unreadOnly: true,
    };
    if (!emailConfig.userEmail) {
        console.log(chalk.red('❌ USER_EMAIL não configurado'));
        return;
    }
    const notifier = process.env.SLACK_WEBHOOK_URL
        ? new Notifier({ slack: { webhookUrl: process.env.SLACK_WEBHOOK_URL } })
        : undefined;
    const emailAgent = new EmailAgent({
        id: 'email-agent',
        name: 'Agente de Email',
        description: 'Classificação e triagem de emails',
        enabled: true,
        schedule: { type: 'interval', value: 5 },
    }, emailConfig, notifier);
    if (options.auth) {
        console.log(chalk.bold('\n🔐 Autenticação Gmail\n'));
        const authUrl = emailAgent.getAuthUrl();
        console.log('Acesse a URL abaixo para autorizar:');
        console.log(chalk.cyan(authUrl));
        return;
    }
    if (options.run) {
        spinner.start('Inicializando Email Agent...');
        try {
            await emailAgent.initialize();
            spinner.succeed('Email Agent inicializado');
            spinner.start('Buscando e classificando emails...');
            const result = await emailAgent.runOnce();
            if (result.success && result.data) {
                spinner.succeed(`Processados ${result.data.processedCount} emails`);
                console.log(chalk.bold('\n📊 Resumo:\n'));
                console.log(`   🚨 Urgente: ${result.data.classifications.urgent}`);
                console.log(`   🔴 Atenção: ${result.data.classifications.attention}`);
                console.log(`   📄 Informativo: ${result.data.classifications.informative}`);
                console.log(`   📋 Baixa: ${result.data.classifications.low}`);
                console.log(`   📎 Apenas CC: ${result.data.classifications.cc_only}`);
                if (result.data.classifications.urgent > 0) {
                    console.log(chalk.bold.red('\n⚠️  Emails Urgentes:\n'));
                    result.data.emails
                        .filter(e => e.classification.priority === 'urgent')
                        .forEach(e => {
                        console.log(`   • ${e.subject}`);
                        console.log(chalk.gray(`     De: ${e.from.email}`));
                        console.log(chalk.gray(`     Razão: ${e.classification.reasoning}\n`));
                    });
                }
            }
            else {
                spinner.fail(result.error || 'Erro desconhecido');
            }
        }
        catch (error) {
            spinner.fail(error instanceof Error ? error.message : 'Erro desconhecido');
        }
        return;
    }
    if (options.start) {
        const scheduler = getScheduler();
        scheduler.register(emailAgent);
        console.log(chalk.bold('\n🚀 Iniciando Email Agent em modo contínuo...\n'));
        console.log(chalk.gray('   Pressione Ctrl+C para parar\n'));
        await scheduler.startAll();
        // Mantém processo rodando
        process.on('SIGINT', async () => {
            console.log(chalk.yellow('\n\nParando agentes...'));
            await scheduler.stopAll();
            process.exit(0);
        });
    }
});
// Comando: status
program
    .command('status')
    .description('Mostra status de todos os agentes')
    .action(() => {
    const scheduler = getScheduler();
    const agents = scheduler.getAgents();
    console.log(chalk.bold('\n📊 Status dos Agentes\n'));
    if (agents.length === 0) {
        console.log(chalk.yellow('Nenhum agente registrado'));
        return;
    }
    agents.forEach(agent => {
        const statusColor = agent.status === 'running' ? chalk.green :
            agent.status === 'error' ? chalk.red : chalk.gray;
        console.log(`${chalk.bold(agent.config.name)}: ${statusColor(agent.status)}`);
    });
});
program.parse();
//# sourceMappingURL=index.js.map