@echo off
setlocal
chcp 65001 >nul
set "MANAGER_NODE=%~dp0runtime\node.exe"
if exist "%MANAGER_NODE%" goto run
set "MANAGER_NODE=%~dp0runtime\node\node.exe"
if exist "%MANAGER_NODE%" goto run
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js runtime not found. Place node.exe in the runtime folder.
  pause
  exit /b 1
)
set "MANAGER_NODE=node.exe"
:run
"%MANAGER_NODE%" "%~dp0scripts\launcher.cjs" start
if errorlevel 1 (
  pause
  exit /b 1
)
