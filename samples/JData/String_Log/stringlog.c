
int main()
{
  char *names[10] = {"david", "mayer", "justin", "richard", "lekan", "ben", "owen", "nicholas", "karu", "clark"};
  int i;

  for (i = 0; i < 1000; i++) {
    name = names[i % 10];
    printf("Wrote .. name: %s\n", names[i % 10]);
    sleep(1);
  }

}
