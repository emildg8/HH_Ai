# DevOps-поиск: одна команда — сбор + подсказки (Windows PowerShell)
# Запуск из корня репозитория: .\scripts\devops-pipeline.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "=== 1/3 Сбор вакансий (config/devops.env) ===" -ForegroundColor Cyan
npm run devops:harvest
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== 2/3 Дооценка без оценки (если лимит LLM обрезал) ===" -ForegroundColor Cyan
npm run devops:rescore -- --only-placeholder-llm --limit=50

Write-Host "`n=== 3/3 Дашборд ===" -ForegroundColor Cyan
Write-Host "npm run dashboard"
Write-Host "Откройте http://127.0.0.1:3849 — фильтр «Только с оценкой >= 50»"
Write-Host "Экспорт резюме PDF/DOCX: npm run cv:export  -> CV/exports/"
Write-Host "Массовый отклик: npm run devops:apply-batch -- --min-score=50 --limit=20"
Write-Host "Или кнопка «Батч откликов» в дашборде"
