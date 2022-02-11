int getfogid();
int getcloudid();
int getdevid();


int q, p;
jasync localme(int c, char *s)
{
  while(1)
    {
      jsleep(2000);
      q = getfogid();
      printf("############-->>> Hello  ME  %d... %s... %d\n", c, s, q);
    }
}

jasync localyou(int c, char *s)
{
  while(1)
    {
      jsleep(1000);
      p = getcloudid();
      printf("############-->>> Hello YOU  %d, %s... %d\n", c, s, p);
    }
}

jasync localtask()
{
    while(1)
    {
        jsleep(2000);
        printf(">>>>>>> Output from a pure local task... d\n");
    }
}

int main(int argc, char *argv[])
{
  localme(10, "cxxxxyyyy");
  localyou(10, "cxxxxxxxx");
  localtask();
}
