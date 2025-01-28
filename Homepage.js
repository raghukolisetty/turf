// const errorMessage = document.getElementById("errorMessage");
const datePickerContainer = document.getElementById("datePickerContainer");
const dateSelect = document.getElementById("dateSelect");
const hourSlotsContainer = document.getElementById("hourSlots");
const centerContainer = document.getElementById("centerContainer");

document.getElementById("reservationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const now = new Date();
    fetch("/api/dates")
        .then((response) => response.json())
        .then((fetchedData) => {
            const dates = fetchedData.dates || [];
            const hours = dates[0]?.hours || [];
            const filteredHours = hours.filter(hour => hour > now.getHours());
            populateDates(dates, filteredHours);
        })
        .catch((error) => console.error("Error fetching dates:", error));
});

function populateDates(dates) {
    dateSelect.innerHTML = "";

    const optionPlaceHolder = document.createElement("option");
    optionPlaceHolder.value = "";
    optionPlaceHolder.textContent = "--Select Date--";
    optionPlaceHolder.disabled = true;
    optionPlaceHolder.selected = true;
    datePickerContainer.classList.remove("hidden");
    dateSelect.appendChild(optionPlaceHolder);

    dates.forEach((date) => {
        const option = document.createElement("option");
        option.value = date.date;
        option.textContent = date.date;
        dateSelect.appendChild(option);
    });

    if (dates.length > 0) {
        dateSelect.addEventListener("change", async () => {
            const selectedDate = dateSelect.value;
            if (selectedDate) {
                const blockedSlots = await fetchBlockedSlots(selectedDate);
                generateHourlySlots(dates[0].hours, blockedSlots, selectedDate);
            }
        });
    }
}

async function fetchBlockedSlots(date) {
    try {
        const response = await fetch(`/api/blockedSlots?date=${encodeURIComponent(date)}`);
        if (response.ok) {
            const data = await response.json();
            return data.blockedSlots || [];
        } else {
            console.error("Failed to fetch blocked slots:", response.statusText);
            return [];
        }
    } catch (error) {
        console.error("Error fetching blocked slots:", error);
        return [];
    }
}

function generateHourlySlots(hours, blockedSlots, selectedDate) {
    hourSlotsContainer.innerHTML = "";
    const now = new Date();
    const currentHour = now.getHours();
    const currentDate = `${now.getDate()}-${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;

    hours.forEach(hourString => {
        const hour = parseInt(hourString.split(":")[0], 10);
        const hourSlotsWrapper = document.createElement("div");
        hourSlotsWrapper.classList.add("hourWrapper");

        const hourCheckbox = document.createElement("input");
        hourCheckbox.type = "checkbox";
        hourCheckbox.value = hourString;
        hourCheckbox.id = `checkbox-${hourString}`;
        hourCheckbox.classList.add("hourCheckbox");

        if (selectedDate === currentDate && hour <= currentHour) {
            hourCheckbox.disabled = true;
            hourSlotsWrapper.classList.add("slotUnAvailable");
        } else if (blockedSlots.includes(hourString)) {
            hourCheckbox.disabled = true;
            hourSlotsWrapper.classList.add("slotUnAvailable");
        } else {
            hourSlotsWrapper.classList.add("slotAvailable");
        }

        const label = document.createElement("label");
        label.htmlFor = `checkbox-${hourString}`;
        label.textContent = hourString;

        hourSlotsWrapper.appendChild(hourCheckbox);
        hourSlotsWrapper.appendChild(label);
        hourSlotsContainer.appendChild(hourSlotsWrapper);
    });

    const mobileNumberWrapper = document.createElement("div");
    mobileNumberWrapper.classList.add("mobileNumberWrapper", "hidden");

    const mobileNumberInput = document.createElement("input");
    mobileNumberInput.type = "tel";
    mobileNumberInput.id = "mobileNumberInput";
    mobileNumberInput.placeholder = "Whatsapp Number";
    mobileNumberInput.pattern = "/^[6-9]\d{9}$/";
    mobileNumberWrapper.appendChild(mobileNumberInput);

    const continueButton = document.createElement("button");
    continueButton.textContent = "Continue";
    continueButton.type = "button";
    continueButton.id = "continueButton";
    continueButton.disabled = true;
    mobileNumberWrapper.appendChild(continueButton);

    datePickerContainer.appendChild(mobileNumberWrapper);

    const checkBoxes = document.querySelectorAll(".hourCheckbox");
    hourSlotsContainer.addEventListener("change", () => {
        const selectedSlots = Array.from(checkBoxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        if (selectedSlots.length > 0) {
            mobileNumberWrapper.classList.remove("hidden");
        } else {
            mobileNumberWrapper.classList.add("hidden");
        }
    });

    mobileNumberInput.addEventListener("input", () => {
        const isValid = /^[6-9]\d{9}$/.test(mobileNumberInput.value);
        continueButton.disabled = !isValid;
    });

    continueButton.addEventListener("click", async () => {
        const selectedSlots = Array.from(checkBoxes)
            .filter(checkbox => checkbox.checked)
            .map(checkbox => checkbox.value);

        const mobileNumber = mobileNumberInput.value;

        if (selectedDate && selectedSlots.length > 0 && /^[6-9]\d{9}$/.test(mobileNumber)) {
            await sendSlots(selectedDate, selectedSlots, mobileNumber);
            console.log("Slot booked successfully");
        } else {
            console.log("Please enter a valid date, slot and enter a valid mobile number");
        }
    });


    hourSlotsContainer.classList.remove("hidden");
}

async function sendSlots(selectedDate, selectedSlots, mobileNumber) {
    try {
        const response = await fetch("/api/reservations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ date: selectedDate, slots: selectedSlots, mobileNumber: mobileNumber }),
        });

        if (response.ok) {
            console.log(`Slot booked successfully on ${selectedDate} from ${selectedSlots}`)
            displaySuccessMessage(`Slot booked successfully on ${selectedDate} from ${selectedSlots}`);
        } else {
            displayErrorMessage("Failed to Book slots. Please try again.");
            console.error("Failed to send slots. Server responded with:", response.statusText);
        }
    } catch (error) {
        displayErrorMessage("An error occurred. Please try again.");
        console.error("Error sending slots:", error);
    }
}

function displaySuccessMessage(message) {
    displayMessage(message, "success");
}

function displayErrorMessage(message) {
    displayMessage(message, "error");
}

function displayMessage(message, type) {
    const messageElement = document.createElement("div");
    messageElement.id = "userMessage";
    messageElement.textContent = message;

    centerContainer.append(messageElement);
    
    messageElement.style.backgroundColor = type === "success" ? "#d4edda" : "#f8d7da";
    messageElement.style.border = type === "success" ? "1px solid #c3e6cb" : "1px solid #f5c6cb";
    
    // setTimeout(() => {
    //     location.reload();
    // }, 5000);
}