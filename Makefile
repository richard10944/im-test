# PM2 进程管理 Makefile - 增强版

.PHONY: start stop restart logs status monit clean help validate check-env

# 颜色定义
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[0;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

# 检查环境
check-env:
	@which pm2 > /dev/null || (echo -e "${RED}错误: 未找到 pm2 命令，请先安装 PM2${NC}" && exit 1)
	@test -f ecosystem.config.js || (echo -e "${RED}错误: 未找到 ecosystem.config.js 配置文件${NC}" && exit 1)

# 验证配置
validate: check-env
	@echo -e "${GREEN}验证 PM2 配置...${NC}"
	@pm2 list > /dev/null 2>&1 || echo -e "${YELLOW}警告: PM2 守护进程可能未运行${NC}"

# 默认目标 - 显示帮助信息
help:
	@echo -e "${BLUE}PM2 进程管理命令:${NC}"
	@echo -e "  ${GREEN}make start${NC}    - 启动所有服务"
	@echo -e "  ${GREEN}make stop${NC}     - 停止所有服务"
	@echo -e "  ${GREEN}make restart${NC}  - 重启所有服务"
	@echo -e "  ${GREEN}make logs${NC}     - 查看服务日志（最后50行）"
	@echo -e "  ${GREEN}make status${NC}   - 查看服务状态"
	@echo -e "  ${GREEN}make monit${NC}    - 监控服务资源使用"
	@echo -e "  ${GREEN}make clean${NC}    - 清理所有PM2进程"
	@echo -e "  ${GREEN}make validate${NC} - 验证环境和配置"
	@echo -e "  ${GREEN}make help${NC}     - 显示此帮助信息"
	@echo ""
	@echo -e "${BLUE}高级命令:${NC}"
	@echo -e "  ${GREEN}make logs-app name=main-00${NC}   - 查看特定服务日志"
	@echo -e "  ${GREEN}make restart-app name=main-00${NC} - 重启特定服务"
	@echo -e "  ${GREEN}make stop-app name=main-00${NC}    - 停止特定服务"

# 启动所有服务
start: validate
	@echo -e "${GREEN}启动所有服务...${NC}"
	pm2 start ecosystem.config.js
	@echo -e "${GREEN}服务启动完成！使用 'make status' 查看状态${NC}"

# 停止所有服务
stop: check-env
	@echo -e "${YELLOW}停止所有服务...${NC}"
	pm2 stop all
	@echo -e "${GREEN}所有服务已停止${NC}"

# 重启所有服务
restart: validate
	@echo -e "${YELLOW}重启所有服务...${NC}"
	pm2 restart all
	@echo -e "${GREEN}服务重启完成${NC}"

# 查看服务日志
logs: check-env
	@echo -e "${BLUE}显示服务日志（最后50行）...${NC}"
	pm2 logs --lines 50

# 查看服务状态
status: check-env
	pm2 status

# 监控服务资源使用
monit: check-env
	@echo -e "${BLUE}启动资源监控...${NC}"
	pm2 monit

# 清理所有PM2进程
clean: check-env
	@echo -e "${RED}清理所有PM2进程...${NC}"
	pm2 delete all 
	rm -rf cmd
	rm -rf logs
	rm -rf output
	@echo -e "${GREEN}清理完成${NC}"

# 保存当前配置
save: check-env
	pm2 save
	@echo -e "${GREEN}当前配置已保存${NC}"

# 显示详细的进程列表
list: check-env
	pm2 list

# 查看特定服务的日志
logs-app: check-env
ifndef name
	@echo -e "${RED}错误: 请指定服务名称，例如: make logs-app name=main-00${NC}"
	@exit 1
endif
	@echo -e "${BLUE}查看服务 $(name) 的日志...${NC}"
	pm2 logs $(name) --lines 50

# 重启特定服务
restart-app: check-env
ifndef name
	@echo -e "${RED}错误: 请指定服务名称，例如: make restart-app name=main-00${NC}"
	@exit 1
endif
	@echo -e "${YELLOW}重启服务 $(name)...${NC}"
	pm2 restart $(name)

# 停止特定服务
stop-app: check-env
ifndef name
	@echo -e "${RED}错误: 请指定服务名称，例如: make stop-app name=main-00${NC}"
	@exit 1
endif
	@echo -e "${YELLOW}停止服务 $(name)...${NC}"
	pm2 stop $(name)

# 安装依赖（如果项目有package.json）
install:
	@echo -e "${BLUE}安装项目依赖...${NC}"
	npm install

# 生成 TypeScript 脚本（根据你的需求）
generate-scripts:
	@echo -e "${BLUE}生成消息发送脚本...${NC}"
	ts-node generate-scripts.ts

add-friends:
	ts-node src/add_friends.ts
gen-single:
	ts-node src/gen_single_chat_script.ts
gen-group:
	ts-node src/gen_group_chat_script.ts