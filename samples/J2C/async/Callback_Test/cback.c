int id; 

int getid();

jasync testcback(char *m, jcallback cb) 
{
   printf("%s\n", m);
   switch (id) 
     {
      case 1:
	  {
	     
	     cb("c-msg from 1");
	  }
	
	break;
      case 2:
	  {
	     cb("c-msg from 2");
	  }
	break;
      default:
	  {
	     cb("c-msg from unknown");
	  }	
     }
}


int main(int argc, char **argv) 
{
   id = getid(); 
 
}
