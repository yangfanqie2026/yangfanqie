@echo off
chcp 65001 >nul
echo 正在准备洋柿子的工作台...
if not exist node_modules (
  echo 首次运行，正在安装依赖（请稍候）...
  call npm install
)
echo 启动中，稍后请打开浏览器访问 http://localhost:3000
echo 关闭此窗口即可停止程序。
call npm start
pause
