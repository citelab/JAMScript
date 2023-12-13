const useAsync = (defaultData) => {
  const [data, setData] = useState({
    data: defaultData ?? null,
    error: null,
    loading: false,
  });  const run = async (asyncFn) => {
    try {
      setData({ data: null, error: null, loading: true });
      const response = await asyncFn();
      const result = { data: response, error: null, loading: false };
      setData(result);
      return result;
    } catch (error) {
      const result = { data: null, error, loading: false };
      setData(result);
      return result;
    }
  };  return {
    ...data,
    run,
  };
};

export default useAsync
