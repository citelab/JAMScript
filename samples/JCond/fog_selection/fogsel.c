
int initialized = false;
int getid();

jasync docinit() {

  if (!initialized) {
    initialized = true
    
    int myid = getid();
    printf("My id %d\n", myid);




  }
}


int main() {
  printf("Started C node...\n");

}
