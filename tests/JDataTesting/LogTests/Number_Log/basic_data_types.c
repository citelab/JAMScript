
int main() {
  int i;
  char *names[10] = {"david", "mayer", "justin",   "richard", "lekan",
                     "ben",   "owen",  "nicholas", "karu",    "clark"};

  for (i = 0; i < 1000; i++) {
    int q = rand() % 100;
    test_int = q;
    test_string = names[i % 10];
    test_float = rand() % 100 + (rand() % 100) * 0.01;
    printf("Wrote .. qq: %d\n", q);

    sleep(1);
  }
}
