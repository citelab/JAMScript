#include "../jcond.h"

int main(int argc, char *argv[])
{
   jcond_init_duktape();
   jcond_eval_string("var sys = {type: 'device'};");
   jcond_eval_string("var sync = {};");
   jcond_eval_string("var exec = {};");
   jcond_eval_string("sys.tag = 'sensor';");
   printf("DONE!\n");

   jcond_eval_string("function jcondContext(a) { if (/__/.test(a)) return a; else return 'qq'; };");

//   printf("String %s\n", jcond_eval_string_string("jcondContext('sys.type == \"device\"')"));
   printf("String %s\n", jcond_eval_string_string("jcondContext('sys')"));


}
