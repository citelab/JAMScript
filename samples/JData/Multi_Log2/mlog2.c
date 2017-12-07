
int main() 
{
  char *names[10] = {"david", "mayer", "justin", "richard", "lekan", "ben", "owen", "nicholas", "karu", "clark"};
  int i;
  char buf[256];

  for (i = 0; i < 1000; i++) {

    sprintf(buf, "%s: %d", names[i % 10], i);
    name = buf;;
    sleep(1);
  }

}
