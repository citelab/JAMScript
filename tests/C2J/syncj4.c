int getfogid();
int getdevid();


int q, p;
jasync localme(int c, char *s)
{
  while(1)
    {
        jsleep(10000);
      q = getfogid();
      printf("############-->>> Hello  ME  %d... %s... %d\n", c, s, q);
    }
}

jasync localyou(int c, char *s)
{
  while(1)
    {
        jsleep(15000);
      p = getdevid();
      printf("############-->>> Hello YOU  %d, %s... %d\n", c, s, p);
    }
}

jasync localtask()
{
    while(1)
    {
        jsleep(20000);
        printf(">>>>>>> ddddd d\n");
    }
}

int main(int argc, char *argv[])
{
  localme(10, "cxxxxyyyy");
  localyou(10, "cxxxxxxxx");
  localtask();
}
