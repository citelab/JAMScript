#include "funcreg.h"
#include <string.h>

typedef struct __FuncLookupTable {
  char funcName[FUNC_LEN_MAX];
  void (*funcPtr)(void);
  size_t stackSize;
  struct timespec durationEstimated;
} FuncLookupTable;

static FuncLookupTable funcLookupTable[FUNC_MAX_REG];
static __thread FuncLookupTable funcLookupTablet[FUNC_MAX_REG];
static int idxFuncReg = 0;
static __thread int idxFuncRegt = 0;

void ForkFunctionTableToThread() {
  idxFuncRegt = idxFuncReg;
  for (int i = 0; i < idxFuncReg; i++) {
    strcpy(funcLookupTablet[i].funcName, funcLookupTable[i].funcName);
    funcLookupTablet[i].funcPtr = funcLookupTable[i].funcPtr;
    funcLookupTablet[i].stackSize = funcLookupTable[i].stackSize;
    funcLookupTablet[i].durationEstimated = funcLookupTable[i].durationEstimated;
  }
}

void RegisterFunctionByName(void (*func)(void), const char *name, size_t stackSize, struct timespec dur) {
  strcpy(funcLookupTable[idxFuncReg].funcName, name);
  funcLookupTable[idxFuncReg].stackSize = stackSize;
  funcLookupTable[idxFuncReg].funcPtr = func;
  funcLookupTable[idxFuncReg].durationEstimated = dur;
  idxFuncReg++;
}

void (*GetFunctionByName(const char *name, size_t namelen))(void) {
  for (int i = 0; i < idxFuncRegt; i++) {
    if (!strncmp(funcLookupTablet[i].funcName, name, namelen)) {
      return funcLookupTablet[i].funcPtr;
    }
  }
  return NULL;
}

size_t GetStackSizeByName(const char *name, size_t namelen) {
  for (int i = 0; i < idxFuncRegt; i++) {
    if (!strncmp(funcLookupTablet[i].funcName, name, namelen)) {
      return funcLookupTablet[i].stackSize;
    }
  }
  return 0;
}

struct timespec GetDurationByName(const char *name, size_t namelen) {
  for (int i = 0; i < idxFuncRegt; i++) {
    if (!strncmp(funcLookupTablet[i].funcName, name, namelen)) {
      return funcLookupTablet[i].durationEstimated;
    }
  }
  return (struct timespec){0, 0};
}