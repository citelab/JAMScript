#pragma once
#ifdef __cplusplus
extern "C" {
#endif
#include "config.h"

typedef void (*PreemptionHandlerType)(int);
typedef void (*CleanupHandlerType)(void *);
 
/**
 * Create Context
 * Initialize Standalone Stack Context
 * @param ucp: pointer to context to be initialized
 * @param size: stack size
 * @param fn: function to be run for the context
 * @remark: pointer to task is contigious memory of context header + stack
 */ 
int CreateContext(void *ucp, unsigned long int stackSize, void (*fn)(void));

/**
 * Create Context
 * Initialize Copy Stack Context
 * Q & A
 * How copy stack works?
 * Before context swapped out, memory started from current stack pointer to 
 * initial stack pointer (when task started) will be copied into copy stack 
 * (the one user allocated, contigous with @ref ucp), when context swapped 
 * back, content of copy stack will be copied back to the (shared) stack 
 * that the task will run on. 
 * Why copy stack?
 * suppose you have several tasks like this 
 * {
 *   BeginContext();
 *   int a;
 *   while (a = b++) {
 *     printf("%d\n", a); // assume printf uses a lot of stack
 *     ContextSwitch(...);
 *   }
 *   ContextSwitch(...);
 * }
 * tasks shown above does need a pretty large stack to run (due to printf)
 * However, if we would like to switch out outside printf, we don't need 
 * the portion of stack other than the WORD sized var a. Suppose you have
 * N tasks, each uses M bytes (M >> 4) of stack in maximum. 
 * If you use standalone stack context, you would need N * M bytes in total. 
 * If you use copy stack context, you would need N * 4 bytes in total. 
 * What are the limitations?
 * The task cannot let another task return the value by pointer to a variable 
 * allocated on (shared) stack. For example, suppose the following is copy stack
 * {
 *   int retval;
 *   CreateContext(taskCompute, .., compute);
 *   SetContextData(taskCompute, &retval);
 *   ContextSwitchTo(taskCompute);
 *   printf("%d\n", retval);
 * }
 * This will cause undefined behaviour, since the memory location of retval
 * will be another variable of another context (taskCompute in this case), causing
 * undefined behaviour. 
 * @param ucp: pointer to context to be initialized
 * @param size: stack size
 * @param fn: function to be run for the context
 * @remark: pointer to task is contigious memory of context header + copy stack
 * @warning: read Q & A first
 */ 
int CreateCopyStackContext(void *ucp, unsigned long int stackSize, void (*fn)(void));

/**
 * Context Switch
 * Switch from one context @ref from to the other @ref to
 * Applicable to both copy stack context and standalone stack context
 * @param from: source context
 * @param to: dest context
 * @warning Could be called only from inside task
 */
int ContextSwitch(void *from, void *to);

/**
 * Context Switch To
 * Switch from the current context to the other @ref to
 * Applicable to both copy stack context and standalone stack context
 * @param to: dest context
 * @warning Could be called only from inside task
 */
int ContextSwitchTo(void *to);
int ContextSwitchTo2(void *dest);

/**
 * Initalize Copy Stack Execution Environment
 * Initialize shared stack and calculate shared stack limit and aligned pointer
 * with default stack size allocated on data segment
 */ 
int CopyStackInitByDefault();

/**
 * Initalize Copy Stack Execution Environment
 * Initialize shared stack and calculate shared stack limit and aligned pointer
 * with custom stack size allocated on any segment
 */ 
int CopyStackInitWith(void *, unsigned long int);

/**
 * Use the current execution environment to run copy stack
 * Used by work stealing before copy stack task executed
 */ 
int RefreshStackContext(void *ucp);

/**
 * Enable Preemption with user defined preemption handler
 * Could be used to implement preemptive FIFO scheduing
 * @param p: preemption handler
 */
int EnablePreemptionWith(PreemptionHandlerType p);

/**
 * Make Context Preemptive
 * set isPreemptive bit of task to 1
 */
int MakeContextPreemptive(void *);

/**
 * Send preemption signal to target thread that executes preemptive context
 */
int PreemptThread(void *);

/**
 * Use custom main context
 */ 
int InitWith(void *lpMainContext);

/**
 * Some times, we don't want preemption 
 * For example, inside a spin lock
 */
int DisablePreemptionSignal();
int EnablePreemptionSignal(int prev);
int GetIsContextSwitching();

#define JAMC_DISABLE_PREEMPTION_BEGIN \
  int __isContextSwitching = GetIsContextSwitching(); \
  DisablePreemptionSignal(); 

#define JAMC_DISABLE_PREEMPTION_END \
  EnablePreemptionSignal(__isContextSwitching);

/**
 * Begin Context
 * clean up previous context, reset signal flag if swapped from a preempted context
 * @warning Must be inserted as the first statement of the context function
 * @warning Could be called only from inside context
 * @warning Exempted when BeginTask() used
 * @ref BeginTask
 */
int BeginContext();

/**
 * Set Context Data
 * Set the void *data entry of the context pointed by @ref ucp to @ref dt
 */
int SetContextData(void *, void *);

/**
 * Get Context Data
 * Get the void *data entry of the context pointed by @ref ucp to @ref dt
 */
int GetContextData(void *rData, void *ucp);

/**
 * Get Active Context
 * Get pointer to context that is running
 * @param ucpp: pointer to pointer to context, used to return context pointer value
 * @warning Could be called only from inside context
 */
int GetCurrentContext(void *ucpp);
int GetCopyStackLocations(void *lpBE);

#define JAMC_USER_CONTEXT_MEMBERS                        \
  unsigned long int registers[JAMC_NUM_DE_REG_EN_QWORD]; \
  unsigned long int isCopyStackContext : 1;              \
  unsigned long int isPreemptiveStackContext : 1;        \
  unsigned long int stackSize, usedStackSize;            \
  void *data;

typedef struct __JAMScriptUserContextHeader {
  JAMC_USER_CONTEXT_MEMBERS
} JAMScriptUserContextHeader;

/**
 * Declare Context
 * Allocate memory of context on stack or data segment 
 * @param cn: name of context variable
 * @param ssz: stack size of context
 */
#define DeclContext(cn, ssz)                                 \
  unsigned char cn[ssz + sizeof(JAMScriptUserContextHeader)] \
      __attribute__((aligned(JAMC_STACK_ALIGNMENT)))

#ifdef __cplusplus
}
#endif