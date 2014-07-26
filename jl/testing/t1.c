#include <mach/task.h>
#include <stdio.h>
#include <stdlib.h>

int getmem (unsigned int *rss, unsigned int *vs)
{
    task_t task = MACH_PORT_NULL;
    struct task_basic_info t_info;
    mach_msg_type_number_t t_info_count = TASK_BASIC_INFO_COUNT;

    if (KERN_SUCCESS != task_info(mach_task_self(),
       TASK_BASIC_INFO, (task_info_t)&t_info, &t_info_count))
    {
        return -1;
    }
    *rss = t_info.resident_size;
    *vs  = t_info.virtual_size;
    return 0;
}


main()
{
    int temp;

    printf("Starting "); scanf("%d", &temp);

    printf("Testing memory \n");
    for (int i = 0; i < 1000; i++) {
	int rss, vs;
	getmem(&rss, &vs);
	malloc(1000000);
	printf("Rss %d, vs %d\n", rss, vs);
    }
    printf("Stopping "); scanf("%d", &temp);
}
