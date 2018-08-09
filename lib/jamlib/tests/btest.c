#include "../base64.h"

main()
{
   char *inpstr = "ddfdf dfsdf jdsjfdsf jdfsd fsd";
   char ostr[strlen(inpstr) * 2];
   
   nn_base64_encode (inpstr, strlen(inpstr), ostr, strlen(inpstr) * 1.5);
   printf("Ostr %s\n", ostr);
   
   char tstr[strlen(inpstr) * 2];
   nn_base64_decode (ostr, strlen(ostr), tstr, strlen(inpstr));
   
   if (strcmp(inpstr, tstr) == 0)
     printf("Matched\n");
   else
     printf("Not matched\n");
   
}
