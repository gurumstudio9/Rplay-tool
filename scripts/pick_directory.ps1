$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'ImageFolderPicker.cs')
$selected = [ImageFolderPicker]::Pick($env:CHARACTER_MANAGER_PICKER_START)
if ($selected) {
    [Console]::Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($selected)))
}
