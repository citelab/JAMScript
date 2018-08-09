void execProgCloudFromFog(char* progPath, char* inFlowId, char* outFlowId, char* targetType, char* targetId, char* nodeId, char* taskId);

jasync exec_prog_cloud_from_fog(char* progPath, char* inFlowId, char* outFlowId, char* targetType, char* targetId, char* nodeId, char* taskId)
{
  execProgCloudFromFog(progPath, inFlowId, outFlowId, targetType, targetId, nodeId, taskId);
}

void execProgCloudFromDevice(char* progPath, char* inFlowId, char* outFlowId, char* targetType, char* targetId);

jasync exec_prog_cloud_from_device(char* progPath, char* inFlowId, char* outFlowId, char* targetType, char* targetId)
{
  execProgCloudFromDevice(progPath, inFlowId, outFlowId, targetType, targetId);
}

void execProgFogFromDevice(char* progPath, char* inFlowId, char* outFlowId, char* targetType, char* targetId);

jasync exec_prog_fog_from_device(char* progPath, char* inFlowId, char* outFlowId, char* targetType, char* targetId)
{
  execProgFogFromDevice(progPath, inFlowId, outFlowId, targetType, targetId);
}

int main(int argc, char* argv[])
{
  return 0;
}
