
int getid();
void pingj(int num);

jasync doping() {
  int myid = getid();
  printf("My id %d\n", myid);

  pingj(myid);
}  


int main() {
  printf("Started...\n");
}
