Output ../clips/raw/05-aws-terminal.mp4

Set Shell "bash"
Set Width 1920
Set Height 1080
Set FontSize 24
Set Padding 56
Set Framerate 30
Set TypingSpeed 14ms
Set Theme { "name": "rs800", "background": "#111315", "foreground": "#F3F0E9", "cursor": "#F28C45", "selection": "#34383A", "black": "#1D2022", "red": "#E66E62", "green": "#72B8C5", "yellow": "#E8B84C", "blue": "#72B8C5", "magenta": "#F28C45", "cyan": "#72B8C5", "white": "#F3F0E9", "brightBlack": "#A7ABA8", "brightRed": "#E66E62", "brightGreen": "#72B8C5", "brightYellow": "#E8B84C", "brightBlue": "#72B8C5", "brightMagenta": "#F28C45", "brightCyan": "#72B8C5", "brightWhite": "#FFFFFF" }

Hide
Type "export PS1='\[\e[38;2;242;140;69m\]aws\[\e[0m\] $ ' AWS_PAGER='' AWS_REGION=us-east-1 PLAN=plan-6128ca999117 && clear"
Enter
Sleep 500ms
Show

Type "# 1. CloudWatch: what the Lambda logged for the plus-3-degree replan"
Enter
Type `aws logs filter-log-events --log-group-name /aws/lambda/rs800-api --filter-pattern "\"$PLAN\"" --query 'events[].message' --output text | tr '\t' '\n' | jq -c 'select(.event)'`
Sleep 400ms
Enter
Wait+Screen@30s /plan_recalculated/
Sleep 3s

Type "# 2. DynamoDB: the stored plan, linked to its parent"
Enter
Type `aws dynamodb get-item --table-name rs800-plans --key "{\"pk\":{\"S\":\"PLAN#$PLAN\"},\"sk\":{\"S\":\"PLAN\"}}" --projection-expression 'plan_id, parent_plan_id, scheduled_income, shortfall, created_at' | jq -c .Item`
Sleep 400ms
Enter
Wait+Screen@30s /"N":"650"/
Sleep 3s

Type "# 3. Lambda: the function that ran the OR-Tools solver"
Enter
Type `aws lambda get-function-configuration --function-name rs800-api --query '{Function:FunctionName,Runtime:Runtime,MemoryMB:MemorySize,LastModified:LastModified}' --output table`
Sleep 400ms
Enter
Wait+Screen@30s /GetFunctionConfiguration/
Sleep 4s
