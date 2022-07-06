export function createCTaskWrapper(
  returnType: string,
  functionName: string,
  functionParams: Array<string>
): string {
  let cOut = "";
  if (returnType === "void") {
    cOut += `void call_${functionName}(context_t ctx){\n`;
    cOut += "(void)ctx;\n";
    cOut += "arg_t *t = (arg_t *)(task_get_args());\n";
    cOut += `${functionName}(${functionParams.map(
      (_, index) => `t[${index}].val.sval`
    )})\n`;
    cOut += `command_arg_inner_free(t);\n`;
    cOut += "}\n";
  } else {
    cOut += `void call_${functionName}(context_t ctx){\n`;
    cOut += "(void)ctx;\n";
    cOut += "arg_t *t = (arg_t *)(task_get_args());\n";
    cOut += "arg_t retarg; = calloc(1, sizeof(arg_t));\n";
    cOut += `retarg.type = ${() => {
      switch (returnType) {
        case "char*":
          return "STRING_TYPE";
        case "int":
          return "INTEGER_TYPE";
        case "float":
          return "FLOAT_TYPE";
      }
    }};\n`;
    cOut += "retarg.nargs = 1;\n";
    cOut += `retarg.val.sval = strdup(${functionName}(${functionParams.map(
      (_, index) => `t[${index}].val.sval`
    )}));\n`;
    cOut += "mco_push(mco_running(), &retarg, sizeof(arg_t));\n";
    cOut += "command_arg_inner_free(t);\n";
    cOut += "}\n";
  }
  return cOut;
}
