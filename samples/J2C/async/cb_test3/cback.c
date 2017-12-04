int id; 

int getid();


jasync test2(char *m, jcallback ccc) 
{
  char *s = "fffff";
  ccc(s);

}


int main(int argc, char **argv) 
{
   id = getid();
   printf("My id %d\n", id);
 
}
