
void pong();

int ping() {
    pong();
    return 0;
}

int main(int argc, char **argv) {
  int i;

  for(i = 0; i < 10; i++) {
    sleep(3);
    ping();
  }
  return 0;
}
