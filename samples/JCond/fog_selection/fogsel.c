
int getMyId();

jasync call_get_myid(char *msg, jcallback putid) {

  char buf[256];
  int myid = getMyId();

  if (jam_error == 0) {
    printf("My id %d\n", myid);
    sprintf(buf, "%d", myid);
    putid(buf);
  }
}


int main() {
  printf("Started C node...\n");

}
