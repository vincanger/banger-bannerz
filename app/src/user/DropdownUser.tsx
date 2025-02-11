import { type User } from 'wasp/entities';
import { useEffect, useRef, useState } from 'react';
import { CgProfile } from 'react-icons/cg';
import { UserMenuItems } from './UserMenuItems';
import { cn } from '../client/cn';

const DropdownUser = ({ user }: { user: Partial<User> }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const trigger = useRef<any>(null);
  const dropdown = useRef<any>(null);

  const toggleDropdown = () => setDropdownOpen((prev) => !prev);

  useEffect(() => {
    const clickHandler = ({ target }: MouseEvent) => {
      if (!dropdown.current) return;
      if (!dropdownOpen || dropdown.current.contains(target) || trigger.current.contains(target)) {
        return;
      }
      setDropdownOpen(false);
    };
    document.addEventListener('click', clickHandler);
    return () => document.removeEventListener('click', clickHandler);
  });

  // close if the esc key is pressed
  useEffect(() => {
    const keyHandler = ({ keyCode }: KeyboardEvent) => {
      if (!dropdownOpen || keyCode !== 27) return;
      setDropdownOpen(false);
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  });

  return (
    <div className='relative'>
      <button
        ref={trigger}
        onClick={toggleDropdown}
        className='flex items-center gap-4 duration-300 ease-in-out text-gray-900 hover:text-yellow-500'
      >
        <CgProfile size='1.5rem' className='mt-[0.1rem] dark:text-white' />
      </button>

      {/* <!-- Dropdown --> */}
      <div
        ref={dropdown}
        className={cn(
          'absolute right-0 bottom-full mb-8 flex w-62.5 flex-col rounded-xl border border-stroke bg-white shadow-default dark:border-strokedark dark:bg-boxdark dark:text-white',
          {
            hidden: !dropdownOpen,
          }
        )}
      >
        <UserMenuItems user={user} setMobileMenuOpen={toggleDropdown} />
      </div>
    </div>
  );
};

export default DropdownUser;
