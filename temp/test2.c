
#include "jam.h"

char *app_id = "re";

void taskmain(int argc, char **argv)
{
   jamstate_t *js = jam_init(1883, 2, 0);


   for (int i = 0; i < 1000000; i++)
     {
	nvoid_t *nv = jamdata_encode("if", "temperature", i + 25, "weight", i * 52.4);
	jamdata_logto_server("testglobal", "qq", nv);
	
     }

   
}


