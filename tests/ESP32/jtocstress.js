let count = 10;
let test_amount = 5000;
let i = 0;

function tests()
{
    while(true)
    {
	espcount();
	new Promise(resolve => setTimeout(resolve, 1));
    }
}

tests();

clear_counter();

while(true)
{
    let x = espcountret();
}
