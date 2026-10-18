param([string]$Project = 'C:\Users\jonathan\src\passless-harmony\harmonyos')
$ErrorActionPreference = 'Stop'
$toolRoot = 'C:\Huawei\DevEcoStudio\DevEco Studio 26.0.0'
$env:DEVECO_SDK_HOME = "$toolRoot\sdk"
$env:HARMONYOS_SDK_HOME = $env:DEVECO_SDK_HOME
$env:JAVA_HOME = "$toolRoot\jbr"
$env:JAVA_TOOL_OPTIONS = '-Dfile.encoding=UTF-8 -Duser.language=zh -Duser.country=CN'
$env:Path = "$toolRoot\tools\node;$toolRoot\tools\ohpm\bin;$env:JAVA_HOME\bin;$env:Path"
Set-Location $Project
& "$toolRoot\tools\ohpm\bin\ohpm.bat" install --registry https://repo.harmonyos.com/ohpm/
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& "$toolRoot\tools\hvigor\bin\hvigorw.bat" assembleHap --no-daemon --stacktrace
exit $LASTEXITCODE
