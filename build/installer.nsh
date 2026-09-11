!macro customInit
  DetailPrint "Instalando pré-requisitos do sistema (Visual C++ Redistributable)..."
  File "/oname=$PLUGINSDIR\vc_redist.x64.exe" "vc_redist.x64.exe"
  ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /install /quiet /norestart'
!macroend
