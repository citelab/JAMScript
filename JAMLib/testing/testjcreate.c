#include <stdio.h>
#include "json.h"

/*
 * This is testing the JSON creation functions..
 */
int main(int argc, char *argv[])
{
    JSONObject *jo = create_object();
    JSONValue *fval = create_value();
    set_string(fval, "Hello, World");
    add_property(jo, "myattr", fval);
    JSONValue *sval = create_value();
    set_true(sval);
    add_property(jo, "flag", sval);

    JSONArray *ar = create_array();



    finalize_object(jo);

    JSONValue *oval = create_value();
    set_object(oval, jo);
    print_value(oval);

}
