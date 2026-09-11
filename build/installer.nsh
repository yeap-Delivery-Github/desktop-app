!macro customInit
  DetailPrint "Instalando pré-requisitos do sistema (Visual C++ Redistributable)..."
  File "/oname=$PLUGINSDIR\vc_redist.x64.exe" "${BUILD_RESOURCES_DIR}\vc_redist.x64.exe"
  ExecWait '"$PLUGINSDIR\vc_redist.x64.exe" /install /quiet /norestart'
!macroend
