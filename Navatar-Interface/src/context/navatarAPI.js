import axios from "./axiosInstance";

const BASE_URL = "/bookings/hospital";

export const getNavatarsByHospital = (hospitalId) => {
  return axios.get(`${BASE_URL}/${hospitalId}`);
};


// import dummyBookings from "../dummyBookings";

// export const getNavatarsByHospital = async (hospital_id) => {
//   const filtered = dummyBookings.filter((b) => b.hospital_id === hospital_id);
//   return { data: filtered };
// };
