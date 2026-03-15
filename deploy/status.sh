#!/usr/bin/env bash

sudo systemctl status mikopoker --no-pager
echo ""
echo "Logs (last 20 lines):"
sudo journalctl -u mikopoker -n 20 --no-pager
