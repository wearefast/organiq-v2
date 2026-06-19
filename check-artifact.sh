DB_URL=$(docker exec organiq-server sh -c 'echo $DATABASE_URL')
docker exec organiq-server sh -c "psql '$DB_URL' -t -c \"SELECT jsonb_pretty(sa.data) FROM step_artifacts sa JOIN workflow_steps ws ON sa.workflow_step_id = ws.id WHERE ws.step_key='competitor-metrics' AND sa.workflow_run_id='d7af711b-4b3e-4b3b-b93f-7759b7cce215' ORDER BY sa.created_at DESC LIMIT 1\" 2>&1 | head -80"
