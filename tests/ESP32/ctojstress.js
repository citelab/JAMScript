let count = 0;

jtask function increase_counter() {
    count++;
}

async function sleep(duration)
{
    return new Promise(resolve => setTimeout(resolve, duration));
}

async function report_counter()
{
    while(true)
    {
        console.log("Current count: " + count);
        count = 0;
        await sleep(1000);
    }
}

report_counter();