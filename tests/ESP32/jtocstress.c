int64_t esp_timer_get_time();

uint32_t counter;

jtask* espcount() 
{
    counter++;
}

jtask* clear_counter()
{
    counter = 0;
}

jtask int espcountret() 
{
    return counter++;
}

jtask* localyou() 
{
    int64_t start_time = esp_timer_get_time();
    int64_t end_time = 0;
    while(1) 
    {
        end_time = esp_timer_get_time();
        printf("---->> Value = %lu Testing Interval: %lld \n", counter, end_time-start_time);
        counter = 0;
        start_time = esp_timer_get_time();
        jsleep(10000);
    }
}

int main(int argc, char *argv[])
{
    counter = 0;
    localyou();
    return 0;
}
