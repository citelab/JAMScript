int id; 

int getid();


jasync test2(char *m, jcallback ccc) 
{
char *s = "fffff";
  if (1) 
    ccc(s);

}


jasync testcback(char *m, jcallback cb) 
{
  char *s1 = "c-msg from 1";
  char *s2 = "c-msg from 2";
   printf("=========>>>>%s\n", m);
   switch (id) 
     {
      case 1:

	     cb(s1);
	
	break;
      case 2:

	cb(s2);

	break;
      default:
	     cb("c-msg from unknown");
     }
}


int main(int argc, char **argv) 
{
   id = getid();
   printf("My id %d\n", id);
 
}
