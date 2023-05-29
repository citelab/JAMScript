#define SLOWDOWN_THRESHOLD 100

void request_slowdown();

int factorials_total = 0;
int factorials_in_progress = 0;


jtask int compute_factorial(int number)
{
    int accumulator =    1;

    if(factorials_in_progress > SLOWDOWN_THRESHOLD)
    {
        request_slowdown();
    }

    factorials_in_progress++;

    for(int i = 1; i < number; i++)
    {
        accumulator *= i;
    }

    factorials_in_progress--;

    factorials_total++;

    return accumulator;
}

char buf[256];
jtask char* get_factorial_status()
{
    sprintf(buf, "Total Factorials Computed: %d\nFactorials in progress: %d", factorials_total, factorials_in_progress);

    return buf;
}

jtask int get_active_factorials()
{
    return factorials_in_progress;
}

jtask* status_monitor()
{
    while(1)
    {
        printf("================================\n%s\n", get_factorial_status());
        jsleep(100000);
    }
}

int main(int argc, char *argv[])
{
    status_monitor();
    return 0;
}