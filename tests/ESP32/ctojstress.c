int64_t esp_timer_get_time();
void dump_heap_left();

void increase_counter();

uint32_t counter;

jtask* localyou() 
{
    int64_t start_time = esp_timer_get_time();
    int64_t end_time = 0;
    while(1) 
    {
        end_time = esp_timer_get_time();
        printf("---->> Sent Packets = %lu Testing Interval: %lld \n", counter, end_time-start_time);
        dump_heap_left();
        counter = 0;
        start_time = esp_timer_get_time();
        jsleep(50000);
    }
}

jtask* send_everything()
{
    jsleep(1000);
    while(1)
    {
        increase_counter();
        counter++;
    }
}

int main(int argc, char *argv[])
{

    printf("Starting c to j stress test.\n");

    counter = 0;
    localyou();
    send_everything();
    return 0;
}
