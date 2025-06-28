export const formatZipCode = (zipCode: string): string => {
  if (zipCode) {
    zipCode = zipCode.replace(/\D/g, "");
    zipCode = zipCode.replace(/^(\d{5})(\d)/, "$1-$2");
    return zipCode;
  }

  return "";
};
