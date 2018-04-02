void execProgCloudFromFog(char* progPath, char* targetType, char* targetId, char* nodeId, char* taskId);
void execProgCloudFromDevice(char* progPath, char* targetType, char* targetId);
void execProgFogFromDevice(char* progPath, char* targetType, char* targetId);

jasync exec_prog_cloud_from_fog(char* prog_path, char* target_type, char* target_id, char* node_id, char* task_id)
{
	execProgCloudFromFog(prog_path, target_type, target_id, node_id, task_id);
}

jasync exec_prog_cloud_from_device(char* prog_path, char* target_type, char* target_id)
{
	execProgCloudFromDevice(prog_path, target_type, target_id);
}

jasync exec_prog_fog_from_device(char* prog_path, char* target_type, char* target_id)
{
	execProgFogFromDevice(prog_path, target_type, target_id);
}

int main(int argc, char* argv[])
{
	return 0;
}
