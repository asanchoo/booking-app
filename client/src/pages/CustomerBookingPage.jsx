import React, { useEffect, useState } from 'react';
import { fetchServices, fetchSlots, createBooking } from '../api/bookingApi.js';
import ServiceCard from '../components/ServiceCard.jsx';
import SlotPicker from '../components/SlotPicker.jsx';
import BookingForm from '../components/BookingForm.jsx';
import { Scissors, CheckCircle, RefreshCw, AlertCircle, Home, RotateCcw } from 'lucide-react';
import './CustomerBookingPage.css';

export default function CustomerBookingPage() {
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState(null);

  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // 1. Fetch services on mount
  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setIsLoadingServices(true);
    setError('');
    try {
      const data = await fetchServices();
      setServices(data);
      if (data.length > 0) {
        setSelectedService(data[0]); // Default first service
      }
    } catch (err) {
      setError(err.message || 'Ошибка загрузки услуг');
    } finally {
      setIsLoadingServices(false);
    }
  };

  // 2. Fetch slots when selected service changes
  useEffect(() => {
    if (selectedService) {
      loadSlots(selectedService.id);
    }
  }, [selectedService]);

  const loadSlots = async (serviceId) => {
    setIsLoadingSlots(true);
    setError('');
    setSelectedSlot(null);
    try {
      const data = await fetchSlots(serviceId);
      setSlots(data);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки слотов');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const handleSelectService = (service) => {
    if (selectedService?.id !== service.id) {
      setSelectedService(service);
    }
  };

  const handleBookingSubmit = async (bookingData) => {
    setIsSubmitting(true);
    setError('');
    try {
      const response = await createBooking(bookingData);
      setBookingSuccess(response);
    } catch (err) {
      if (err.status === 409) {
        // Slot conflict handler
        setError('Извините, этот слот только что забронировал другой клиент. Мы обновили расписание, пожалуйста, выберите другое время.');
        // Reload slots to get fresh schedule
        if (selectedService) {
          loadSlots(selectedService.id);
        }
      } else {
        setError(err.message || 'Произошла ошибка при бронировании');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetBooking = () => {
    setBookingSuccess(null);
    setSelectedSlot(null);
    if (selectedService) {
      loadSlots(selectedService.id);
    }
  };

  const goToMainMenu = () => {
    setBookingSuccess(null);
    setSelectedSlot(null);
    if (services.length > 0) {
      setSelectedService(services[0]);
      loadSlots(services[0].id);
    }
  };

  if (bookingSuccess) {
    const booking = bookingSuccess.booking || bookingSuccess;
    const bookingTime = booking.startsAt || booking.start_time;
    const formattedTime = bookingTime
      ? new Date(bookingTime).toLocaleString('ru-RU', {
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return (
      <div className="page-container center-content">
        <div className="success-card glass-panel animate-fade-in">
          <div className="success-icon-wrapper">
            <CheckCircle size={48} className="success-icon" />
          </div>
          <h2>Вы успешно записаны!</h2>
          <p className="success-subtitle">Ждем вас в BarberShop к назначенному времени.</p>

          <div className="success-details">
            <div className="detail-row">
              <span>Услуга:</span>
              <strong>{booking.serviceName || booking.service_name || selectedService?.name}</strong>
            </div>
            <div className="detail-row">
              <span>Дата и время:</span>
              <strong className="time-highlight">{formattedTime}</strong>
            </div>
            <div className="detail-row">
              <span>Имя клиента:</span>
              <strong>{booking.clientName || booking.customer_name}</strong>
            </div>
            <div className="detail-row">
              <span>Телефон:</span>
              <strong>{booking.clientPhone || booking.customer_phone}</strong>
            </div>
          </div>

          <div className="success-actions">
            <button onClick={resetBooking} className="action-button secondary-btn">
              <RotateCcw size={18} />
              <span>Записаться ещё раз</span>
            </button>
            <button onClick={goToMainMenu} className="action-button primary-btn">
              <Home size={18} />
              <span>Главное меню</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="hero-header">
        <h1 className="hero-title">
          Онлайн запись в <span className="gold-text">BARBERSHOP</span>
        </h1>
        <p className="hero-subtitle">
          Выберите подходящую услугу, мастер и удобное время за пару кликов.
        </p>
      </div>

      {error && (
        <div className="global-error-banner animate-fade-in">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Select Service */}
      <section className="booking-section">
        <h2 className="step-heading">
          <span className="step-number">1</span>Выберите услугу
        </h2>

        {isLoadingServices ? (
          <div className="loading-state">
            <RefreshCw className="spinner" size={24} />
            <span>Загружаем список услуг...</span>
          </div>
        ) : (
          <div className="services-grid">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                isSelected={selectedService?.id === service.id}
                onSelect={handleSelectService}
              />
            ))}
          </div>
        )}
      </section>

      {/* Step 2: Select Slot */}
      {selectedService && (
        <section className="booking-section animate-fade-in">
          <h2 className="step-heading">
            <span className="step-number">2</span>Выберите доступное время
          </h2>

          {isLoadingSlots ? (
            <div className="loading-state">
              <RefreshCw className="spinner" size={24} />
              <span>Поиск доступных слотов...</span>
            </div>
          ) : (
            <SlotPicker
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => setSelectedSlot(slot)}
            />
          )}
        </section>
      )}

      {/* Step 3: Fill Details */}
      {selectedService && selectedSlot && (
        <section className="booking-section animate-fade-in">
          <h2 className="step-heading">
            <span className="step-number">3</span>Подтверждение записи
          </h2>
          <BookingForm
            service={selectedService}
            slot={selectedSlot}
            onSubmit={handleBookingSubmit}
            isLoading={isSubmitting}
            errorMessage={''}
          />
        </section>
      )}
    </div>
  );
}
