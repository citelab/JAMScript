#pragma once

// temp setup.
#include "../src/calls.h"
#include "../src/task.h"
#include "../src/cnode.h"
#include "../src/command.h"
//#include "../src/dummy_interface.h"


#define jsleep(x) vTaskDelay(x/1000 * portTICK_PERIOD_MS)
#define milestone_log(x)
#define task_yield() taskYIELD()

void mco_push(void*,void*,void*);
void* mco_running();
typedef void* context_t;

void multicast_test();