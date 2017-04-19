int perank;

jactivity_t *pingserver(int);


jactivity_t *regme(char *, jcallback);

void regcallback(char *msg) {
  if (msg != NULL)
    perank = atoi(msg);
  else
    perank = -1;

  printf("Perank %d\n", perank);

  while(1) {
    sleep(1);
    printf("Pinging %d\n", perank);
    pingserver(perank);
  }

}


int main() {
  printf("Registering...");
  regme("hello", regcallback);
  return 0;
}
