; 安装前结束运行中的 Arena 进程（含 Electron 子进程）
!macro customCheckAppRunning
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 == 0
    DetailPrint "正在关闭运行中的 ${PRODUCT_NAME}..."
    !ifdef INSTALL_MODE_PER_ALL_USERS
      nsExec::Exec `taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
    !else
      nsExec::Exec `cmd /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}" /FI "USERNAME eq %USERNAME%"`
    !endif
    Sleep 2000
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 == 0
      nsExec::Exec `cmd /c taskkill /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
      Sleep 1000
    ${EndIf}
  ${EndIf}
!macroend
