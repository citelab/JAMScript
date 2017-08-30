#include "../jcond.h"

int main(int argc, char *argv[])
{
    jcond_init_duktape();
    jcond_eval_string("var sys = {type: 'device'};");
    jcond_eval_string("sys.tag = 'thermo'");
    jcond_eval_string("var sync = {};");
    jcond_eval_string("var exec = {};");
    jcond_eval_string("sync.degree = 13;");
    jcond_eval_string("sync.confirm = 85.3;");
//    ", tag: 'thermo'}; var b = 1; var a = 20; ");
    //jcond_exec_stmt("var a = 1; var b = 10;");
    printf("%d \n", jcond_eval_bool("sys.tag === 'thermo' && sync.degree==13"));
    printf("%d \n", jcond_eval_int("sync.degree"));
    printf("%f \n", jcond_eval_double("sync.confirm"));
}
