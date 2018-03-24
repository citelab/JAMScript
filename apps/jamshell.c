char* execProgCloud(char* progPath, char* nodeId, char* taskId, char* targetType, char* targetId);
char* execProgFog(char* progPath, char* targetId);

jasync exec_prog_cloud(char* prog_path, char* node_id, char* task_id, char* target_type, char* target_id)
{
	execProgCloud(prog_path, node_id, task_id, target_type, target_id);
}

jasync exec_prog_fog(char* prog_path, char* target_id)
{
	execProgFog(prog_path, target_id);
}

int main(int argc, char* argv[])
{
	return 0;
}
