void me(char *s);
void you(char *s);

jasync localme(int c, char *s)
{
  while(1)
    {
      jsleep(2000);
      printf("############-->>> Hello  ME  %d, %s\n", c, s);
      me(s);
    }
}

jasync localyou(int c, char *s)
{
  while(1)
    {
      jsleep(1000);
      printf("############-->>> Hello YOU  %d, %s\n", c, s);
      you(s);
    }
}

int main(int argc, char *argv[])
{
  localme(10, "cxxxxyyyy");
  localyou(10, "cxxxxxxxx");
}
