
int getid();
void pingj(int num);

int main() {
  int myid = getid();
  printf("My id %d\n", myid);

  pingj(myid);

}
